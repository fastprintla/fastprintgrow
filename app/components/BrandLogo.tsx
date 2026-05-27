type BrandLogoProps = {
  size?: "sm" | "md";
};

export default function BrandLogo({ size = "md" }: BrandLogoProps) {
  const imageSize = size === "sm" ? "h-9 w-14" : "h-11 w-16";
  const textSize = size === "sm" ? "text-lg" : "text-2xl";

  return (
    <div className="flex items-center gap-3">
      <img
        alt="fastprintgrow logo"
        className={`${imageSize} rounded-md bg-white object-contain`}
        src="/fastprintgrow-logo.png"
      />
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1f7a5c]">FPG</p>
        <p className={`${textSize} font-black leading-none text-[#172033]`}>FASTPRINTLA GROW</p>
      </div>
    </div>
  );
}
