type TextPostProps = {
  content: string;
  imageUrl?: string | null;
  imageCredit?: string | null;
};

export function TextPost({ content, imageUrl, imageCredit }: TextPostProps) {
  return (
    <figure className="space-y-3">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="aspect-video w-full rounded-xl bg-foreground/5 object-cover" />
      ) : null}
      <figcaption className="text-[15px] leading-7 text-foreground">{content}</figcaption>
      {imageUrl && imageCredit ? <p className="text-xs leading-5 text-muted">{imageCredit}</p> : null}
    </figure>
  );
}
