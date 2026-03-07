export const metadata = {
  title: 'KhataBot - WhatsApp Expense Tracker',
  description: 'Track expenses via WhatsApp with Claude AI extraction',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
