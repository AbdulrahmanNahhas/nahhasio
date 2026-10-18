import { useId } from "react";

/** Original, bundled cinema artwork. The sign-in screen never exposes private catalog posters. */
export function LoginBackdrop() {
  const id = useId().replace(/:/g, "");
  return (
    <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden" aria-hidden="true">
      <svg
        viewBox="0 0 1800 1100"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full text-primary opacity-60"
      >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="1" className="text-background" stopColor="currentColor" />
          </linearGradient>
          <linearGradient id={`${id}-night`} x1="0" y1="0" x2="0" y2="1">
            <stop className="text-secondary" stopColor="currentColor" />
            <stop offset="1" className="text-background" stopColor="currentColor" />
          </linearGradient>
          <g id={`${id}-space`}>
            <rect width="235" height="350" rx="12" fill={`url(#${id}-sky)`} />
            <circle
              cx="132"
              cy="130"
              r="62"
              className="text-foreground"
              fill="currentColor"
              opacity="0.7"
            />
            <ellipse
              cx="132"
              cy="130"
              rx="108"
              ry="27"
              transform="rotate(-30 132 130)"
              fill="none"
              className="text-foreground"
              stroke="currentColor"
              strokeWidth="5"
              opacity="0.5"
            />
            <path
              d="M0 288 55 236 104 290 153 255 235 307V350H0Z"
              className="text-background"
              fill="currentColor"
            />
            <path
              d="m34 56 3 5-3 5-3-5m158-25 2 4-2 4-2-4m-7 170 3 4-3 4-3-4"
              className="text-foreground"
              fill="currentColor"
            />
          </g>
          <g id={`${id}-mountain`}>
            <rect width="235" height="350" rx="12" fill={`url(#${id}-night)`} />
            <circle cx="68" cy="86" r="35" fill="currentColor" opacity="0.8" />
            <path d="m0 241 94-133 141 177v65H0Z" fill="currentColor" opacity="0.7" />
            <path
              d="m55 164 39-56 42 53-26-9-16-20-17 27Z"
              className="text-foreground"
              fill="currentColor"
              opacity="0.6"
            />
            <path
              d="m0 279 66-57 52 56 65-65 52 67v70H0Z"
              className="text-background"
              fill="currentColor"
            />
            <path
              d="M116 266c-74 24 65 32-2 84"
              fill="none"
              stroke="currentColor"
              strokeWidth="9"
              opacity="0.7"
            />
          </g>
          <g id={`${id}-city`}>
            <rect width="235" height="350" rx="12" fill={`url(#${id}-sky)`} />
            <circle
              cx="119"
              cy="131"
              r="64"
              fill="none"
              className="text-foreground"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.45"
            />
            <path
              d="M0 350V223h34v-64h36v82h25V132h43v91h23v-47h41v82h33v92Z"
              className="text-background"
              fill="currentColor"
            />
            <path
              d="M47 185v10m0 14v10m63-61v10m0 15v10m14-35v10m0 15v10m51 11v10m13-10v10m-13 16v10m13-10v10"
              className="text-foreground"
              stroke="currentColor"
              strokeWidth="4"
              opacity="0.6"
            />
            <path
              d="m79 350 35-110h12l36 110"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.5"
            />
          </g>
        </defs>
        <g transform="translate(-170 -270) rotate(-12 900 550)">
          {[0, 1, 2, 3].flatMap((row) =>
            [0, 1, 2, 3, 4, 5, 6, 7].map((column) => (
              <use
                key={`${row}-${column}`}
                href={`#${id}-${["mountain", "city", "space"][(row + column) % 3]}`}
                x={column * 255}
                y={row * 370}
              />
            )),
          )}
        </g>
      </svg>
    </div>
  );
}
