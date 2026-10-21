import "@testing-library/jest-dom/vitest";
import { MotionGlobalConfig } from "motion/react";

// Tests assert on end states; animations would only add timing to wait on.
MotionGlobalConfig.skipAnimations = true;
