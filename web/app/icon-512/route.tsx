import { renderIcon } from "@/lib/icon";

export async function GET() {
  return renderIcon(512);
}
