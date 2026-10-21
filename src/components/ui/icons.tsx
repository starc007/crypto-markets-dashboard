import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 12.5v-9M4 7.5l4-4 4 4" />
  </Icon>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3.5v9M4 8.5l4 4 4-4" />
  </Icon>
);

export const SortIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 6l3-3 3 3M5 10l3 3 3-3" />
  </Icon>
);

export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M8 1.75l1.93 3.9 4.3.63-3.11 3.03.73 4.29L8 11.57 4.15 13.6l.73-4.29L1.77 6.28l4.3-.63L8 1.75z" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.25 10.25L13.5 13.5" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.75V8l2 1.5" />
  </Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.25l6.25 11H1.75L8 2.25z" />
    <path d="M8 6.5v3M8 11.5v.01" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3.5L5.5 8l4.5 4.5" />
  </Icon>
);

export const TableIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M2 6.5h12M2 10h12" />
  </Icon>
);

export const HeatmapIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="2.5" width="7" height="6.5" rx="1" />
    <rect x="10.5" y="2.5" width="3.5" height="4" rx="1" />
    <rect x="10.5" y="8" width="3.5" height="5.5" rx="1" />
    <rect x="2" y="10.5" width="7" height="3" rx="1" />
  </Icon>
);
