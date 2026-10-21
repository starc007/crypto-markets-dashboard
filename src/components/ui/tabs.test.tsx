// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Tabs, type TabOption } from "./tabs";

type Size = "s" | "m" | "l";

const OPTIONS: TabOption<Size>[] = [
  { value: "s", label: "S", description: "Small" },
  { value: "m", label: "M", description: "Medium" },
  { value: "l", label: "L", description: "Large", disabled: true },
];

function Harness({ onChange }: { onChange?: (value: Size) => void }) {
  const [value, setValue] = useState<Size>("s");
  return (
    <Tabs
      label="Size"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("Tabs", () => {
  it("exposes a named group of options with descriptive labels", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Size" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "S: Small" })).toBeChecked();
  });

  it("changes selection on click", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByText("M"));
    expect(onChange).toHaveBeenCalledWith("m");
    expect(screen.getByRole("radio", { name: "M: Medium" })).toBeChecked();
  });

  it("is a single tab stop that arrow keys move through", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "S: Small" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "M: Medium" })).toBeChecked();
  });

  it("does not select disabled options", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "L: Large" })).toBeDisabled();
    await userEvent.click(screen.getByText("L"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
