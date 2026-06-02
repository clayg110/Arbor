import {
  DocumentIcon,
  MicIcon,
  GlobeIcon,
  RssIcon,
  PencilIcon,
} from "./icons";
import type { SourceType } from "@/lib/types";

const META: Record<
  SourceType,
  { label: string; Icon: typeof DocumentIcon }
> = {
  sec_filing: { label: "SEC filing", Icon: DocumentIcon },
  earnings_transcript: { label: "Earnings call", Icon: MicIcon },
  google_news: { label: "Google News", Icon: GlobeIcon },
  rss_feed: { label: "RSS feed", Icon: RssIcon },
  manual: { label: "Manual", Icon: PencilIcon },
};

export function SignalSourceBadge({ source }: { source: SourceType }) {
  const { label, Icon } = META[source];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted">
      <Icon className="h-3.5 w-3.5 text-subtle" />
      {label}
    </span>
  );
}
