import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Closet Me — AIパーソナルスタイリスト",
  description:
    "被服気候学(Clo値) × Vertex AI Vector Search × Gemini で眠っている手持ち服と今日の予定を結び付けるAIスタイリスト",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
