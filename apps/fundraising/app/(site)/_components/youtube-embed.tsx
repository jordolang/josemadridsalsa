/** Responsive, privacy-enhanced YouTube player that loads only when scrolled near. */
export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-black/10">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  )
}
