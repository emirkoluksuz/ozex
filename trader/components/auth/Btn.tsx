"use client";

export function Btn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className = "", ...rest } = props;
  return (
    <button
      type={props.type ?? "submit"}
      className={`w-full rounded-md bg-orange-500 py-2.5 font-semibold text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...rest}
    />
  );
}
