import { serviceClient } from "./supabase";
import { slug } from "./species-paths";
import sharp from "sharp";

const BUCKET = "illustrations";
const MODEL = "gemini-3.1-flash-image";
const STYLE_REFERENCES = [
  "regulus-satrapa.png",
  "myiarchus-crinitus.png",
  "nannopterum-auritum.png",
];

type Reference = { mimeType: string; data: string };
type Pose = "perched" | "in-flight";

function requiredKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("The illustration service is not configured.");
  return key;
}

async function styleReferences(origin: string): Promise<Reference[]> {
  const references = await Promise.all(
    STYLE_REFERENCES.map(async (file) => {
      const response = await fetch(`${origin}/illustrations/${file}`);
      if (!response.ok) return null;
      return {
        mimeType: response.headers.get("content-type") ?? "image/png",
        data: Buffer.from(await response.arrayBuffer()).toString("base64"),
      };
    }),
  );
  return references.filter((item): item is Reference => item !== null);
}

async function generatePose(
  sciName: string,
  comName: string,
  pose: Pose,
  references: Reference[],
): Promise<{ bytes: Buffer; mimeType: string }> {
  const poseDirection =
    pose === "perched"
      ? "Show the bird in a natural standing or perched profile pose, with the entire body, feet, beak, and tail visible. Do not include a branch."
      : "Show the bird in active side-profile flight with both wings clearly extended and the complete body, beak, feet, wing tips, and tail visible.";

  const prompt = `Create one scientifically recognizable illustration of the ${comName} (${sciName}).
${poseDirection}

Match the supplied Lucy's Birds reference illustrations closely: a vintage ornithological field-guide plate, delicate dark ink outlines, muted natural pigments, restrained colored-pencil and watercolor texture, subtle paper grain, precise feather and field-mark details, and a clean cutout silhouette. Preserve the species' real proportions and identifying coloration. Center the bird with generous even space around it.

Use a transparent background if possible; otherwise use a perfectly clean near-white background (#fcfcfb). No scenery, branch, ground, shadow, text, labels, frame, decorative marks, or extra objects. Generate only one bird.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": requiredKey(),
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              ...references.map((reference) => ({
                inlineData: {
                  mimeType: reference.mimeType,
                  data: reference.data,
                },
              })),
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          responseFormat: {
            image: { aspectRatio: "1:1", imageSize: "1K" },
          },
        },
        // Rare birds are exactly where relying on model memory is weakest.
        // Grounding gives the model current species references while our three
        // supplied images continue to control the illustration style.
        tools: [
          {
            googleSearch: {
              searchTypes: { webSearch: {}, imageSearch: {} },
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(110_000),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("Gemini illustration failed", response.status, detail.slice(0, 600));
    throw new Error("The illustration could not be created. Please try again.");
  }

  const result = await response.json();
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const image = [...parts]
    .reverse()
    .find((part) => !part.thought && part.inlineData?.data);
  if (!image?.inlineData?.data) {
    console.error("Gemini returned no final image", JSON.stringify(result).slice(0, 800));
    throw new Error("The illustration service returned no image. Please try again.");
  }

  return {
    bytes: Buffer.from(image.inlineData.data, "base64"),
    mimeType: image.inlineData.mimeType ?? "image/png",
  };
}

/**
 * Gemini sometimes renders a pale checkerboard instead of returning real
 * transparency. Remove only the near-white area connected to an outside edge,
 * so white plumage inside the bird is preserved. The result is also trimmed and
 * resized to the same web dimensions as the bundled illustrations.
 */
async function cleanCutout(image: {
  bytes: Buffer;
  mimeType: string;
}): Promise<{ bytes: Buffer; mimeType: "image/png" }> {
  const decoded = sharp(image.bytes).ensureAlpha();
  const { data, info } = await decoded.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let read = 0;
  let write = 0;

  const isBackground = (pixel: number) => {
    const offset = pixel * channels;
    if (data[offset + 3] === 0) return true;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return Math.min(r, g, b) >= 225 && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
  };
  const add = (pixel: number) => {
    if (pixel < 0 || pixel >= seen.length || seen[pixel] || !isBackground(pixel)) return;
    seen[pixel] = 1;
    queue[write++] = pixel;
  };

  for (let x = 0; x < width; x += 1) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    add(y * width);
    add(y * width + width - 1);
  }

  while (read < write) {
    const pixel = queue[read++];
    const x = pixel % width;
    if (x > 0) add(pixel - 1);
    if (x < width - 1) add(pixel + 1);
    if (pixel >= width) add(pixel - width);
    if (pixel < width * (height - 1)) add(pixel + width);
  }

  for (let pixel = 0; pixel < seen.length; pixel += 1) {
    if (seen[pixel]) data[pixel * channels + 3] = 0;
  }

  const bytes = await sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(600, 600, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { bytes, mimeType: "image/png" };
}

async function upload(
  sciName: string,
  pose: Pose,
  image: { bytes: Buffer; mimeType: string },
): Promise<string> {
  const extension = image.mimeType.includes("jpeg") ? "jpg" : "png";
  const path = `generated/${slug(sciName)}${pose === "in-flight" ? "-2" : ""}.${extension}`;
  const supabase = serviceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, image.bytes, {
    contentType: image.mimeType,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) {
    console.error("generated art upload failed", error);
    throw new Error("The illustration was created but could not be saved.");
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Generate both poses, store them, and attach them to the collection row. */
export async function generateBirdArt({
  birdId,
  sciName,
  comName,
  origin,
}: {
  birdId: number;
  sciName: string;
  comName: string;
  origin: string;
}): Promise<{ artUrl: string; flightArtUrl: string }> {
  const supabase = serviceClient();
  await supabase.from("birds").update({ art_status: "generating" }).eq("id", birdId);

  try {
    const references = await styleReferences(origin);
    if (references.length === 0) throw new Error("Style references could not be loaded.");

    const [perchedRaw, flightRaw] = await Promise.all([
      generatePose(sciName, comName, "perched", references),
      generatePose(sciName, comName, "in-flight", references),
    ]);
    const [perched, flight] = await Promise.all([
      cleanCutout(perchedRaw),
      cleanCutout(flightRaw),
    ]);
    const [artUrl, flightArtUrl] = await Promise.all([
      upload(sciName, "perched", perched),
      upload(sciName, "in-flight", flight),
    ]);

    const { error } = await supabase
      .from("birds")
      .update({ art_url: artUrl, flight_art_url: flightArtUrl, art_status: "ready" })
      .eq("id", birdId);
    if (error) throw error;
    return { artUrl, flightArtUrl };
  } catch (cause) {
    await supabase.from("birds").update({ art_status: "failed" }).eq("id", birdId);
    throw cause;
  }
}
