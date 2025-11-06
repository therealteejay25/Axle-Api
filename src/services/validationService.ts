export async function validateCommand(command: string): Promise<boolean> {
  const allowed = ["generate script", "run cron", "test code"];
  return allowed.some((cmd) => command.toLowerCase().includes(cmd));
}
