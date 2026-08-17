import ListClient from './ListClient';

export const metadata = {
  title: 'Shopping List — Baker Hub',
  description: 'A shared Pizza Party shopping checklist.',
};

export default async function SharedListPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  return <ListClient shareId={shareId} />;
}
