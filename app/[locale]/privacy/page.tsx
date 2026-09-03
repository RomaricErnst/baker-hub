import PrivacyClient from './PrivacyClient';

export const metadata = {
  title: 'Privacy Policy — Baker Hub',
  description:
    'What Baker Hub collects, who processes it, and how to have it deleted. ' +
    'No analytics, no advertising, no tracking.',
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}
