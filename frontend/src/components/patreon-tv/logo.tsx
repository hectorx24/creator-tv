import type { SVGAttributes } from "react"

export function PatreonTvLogo({ className, ...props }: SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      role="img"
      aria-label="Patreon TV"
      className={className}
      {...props}
    >
      <title>Patreon TV</title>
      <rect width="128" height="128" rx="28" fill="#101827" />
      <path
        d="M35 91V61a29 29 0 0 1 58 0v30"
        fill="none"
        stroke="#ff9d8d"
        strokeWidth="13"
        strokeLinecap="butt"
      />
      <path d="m54 49 29 19-29 19Z" fill="#fff" />
    </svg>
  )
}
