// The "Compartir" card, shared by /blog/[slug] and /empleos/[slug].
//
// Plain anchors and one small client component for the clipboard. No SDKs, no
// third-party scripts, nothing that loads at page view: a share button that
// costs every visitor a network round trip to Facebook — and hands them a
// tracking cookie on a page they only wanted to read — is a worse trade than
// the share is worth (PLAN-NEXT.md §3 U1).
//
// One component rather than the same markup twice: U1's brief is "exactly the
// blog's pattern", and the way to make that literally true, and to keep it true
// after the next copy tweak, is for there to be one pattern.
import CopyLinkButton from './CopyLinkButton';

type Props = {
  /** Prefixed to the URL in the WhatsApp message, where a bare link reads as spam. */
  title: string;
  /** Absolute. A relative path shared into WhatsApp is a dead link. */
  url: string;
  className?: string;
};

export default function ShareLinks({ title, url, className = '' }: Props) {
  return (
    <div className={`bg-white rounded-[10px] border border-[#E7E1D6] p-6 ${className}`}>
      <h2 className="text-sm font-bold text-[#1E1B17] mb-3">Compartir</h2>
      <div className="flex flex-wrap gap-4 text-sm">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#C0362A] font-medium hover:underline"
        >
          WhatsApp
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#C0362A] font-medium hover:underline"
        >
          Facebook
        </a>
        <CopyLinkButton url={url} />
      </div>
    </div>
  );
}
