import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Stack } from "./stack";
import { Card, CardBody } from "../primitives/card";

const meta = {
  title: "Layout/Stack",
  component: Stack,
  tags: ["autodocs"],
  argTypes: {
    direction: { control: "select", options: ["row", "column"] },
    gap: { control: "select", options: [0, 1, 2, 3, 4, 6, 8] },
    align: { control: "select", options: ["start", "center", "end", "stretch", "baseline"] },
    justify: { control: "select", options: ["start", "center", "end", "between", "around"] },
  },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Column: Story = {
  args: {
    gap: 4,
    children: (
      <>
        <Card><CardBody>Item 1</CardBody></Card>
        <Card><CardBody>Item 2</CardBody></Card>
        <Card><CardBody>Item 3</CardBody></Card>
      </>
    ),
  },
};

export const Row: Story = {
  args: {
    direction: "row",
    gap: 3,
    align: "center",
    children: (
      <>
        <Card><CardBody>One</CardBody></Card>
        <Card><CardBody>Two</CardBody></Card>
        <Card><CardBody>Three</CardBody></Card>
      </>
    ),
  },
};
