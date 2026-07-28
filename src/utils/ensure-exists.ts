export function ensureExists<T>(
  it: T | null | undefined,
  message: string = 'value is not defined',
): asserts it is T {
  if (it === null || it === undefined) {
    console.error(message);
    process.exit(-1);
  }
}
