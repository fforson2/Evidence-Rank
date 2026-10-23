type TextPostProps = {
  content: string;
};

export function TextPost({ content }: TextPostProps) {
  return <p className="text-[15px] leading-7 text-foreground">{content}</p>;
}
