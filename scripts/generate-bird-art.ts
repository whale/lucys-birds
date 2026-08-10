import { generateBirdArt } from "../lib/generated-art";
import { serviceClient } from "../lib/supabase";

async function main() {
  const sciName = process.argv.slice(2).join(" ").trim();
  if (!sciName) throw new Error("Pass a scientific name.");

  const supabase = serviceClient();
  const { data: bird, error } = await supabase
    .from("birds")
    .select("id, sci_name, com_name")
    .eq("sci_name", sciName)
    .single();

  if (error || !bird)
    throw error ?? new Error(`No collection bird named ${sciName}.`);

  console.log(`Creating perched and flight illustrations for ${bird.com_name}…`);
  const result = await generateBirdArt({
    birdId: bird.id,
    sciName: bird.sci_name,
    comName: bird.com_name,
    origin: "https://birds.lesmith.me",
  });
  console.log("Illustrations saved:", result.artUrl, result.flightArtUrl);
}

void main();
