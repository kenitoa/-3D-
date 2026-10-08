export async function assertEntryReady(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (response.status !== 200 || !/<canvas\b[^>]*\bid=["']renderCanvas["']/i.test(await response.text())) throw new Error('The local entry page is not ready.');
}
