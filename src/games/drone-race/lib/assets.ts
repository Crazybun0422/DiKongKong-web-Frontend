// Explicit Vite asset imports keep namespaced media in the hashed build output.
const audio = import.meta.glob('../assets/audio/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export function audioUrl(name: string) {
  const url = audio[`../assets/audio/${name}.mp3`];
  if (!url) throw new Error(`Unknown game audio: ${name}`);
  return url;
}
