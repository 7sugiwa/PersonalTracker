// Primitive contract: a component's appearance is chosen entirely by its
// variant / tone / size props, resolved through a lookup record inside
// the component. `className` is reserved for LAYOUT-ONLY utilities a
// primitive never emits itself — col-span-*, m*, w-*, flex-1, hidden.
// Never colors, padding, radius, or borders through className: those
// belong to a variant, or they don't belong on this primitive.
//
// This is what keeps the dependency count at zero (no clsx, no
// tailwind-merge) — there's nothing to "merge" if callers only ever add
// layout utilities that the primitive doesn't already set.

export * from "./cx";
export * from "./card";
export * from "./stat-tile";
export * from "./delta";
export * from "./badge";
export * from "./button";
export * from "./table";
export * from "./bar-list";
export * from "./empty-state";
export * from "./insufficient-history";
export * from "./skeleton";
export * from "./field";
export * from "./section";
