import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Grid } from "./grid";
import { Card, CardBody } from "../primitives/card";

const meta = {
  title: "Layout/Grid",
  component: Grid,
  tags: ["autodocs"],
  argTypes: {
    cols: { control: "select", options: [1, 2, 3, 4, 5, 6, 12] },
    gap: { control: "select", options: [2, 3, 4, 6] },
  },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoColumns: Story = {
  args: {
    cols: 2,
    gap: 4,
    children: (
      <>
        <Card><CardBody>Column 1</CardBody></Card>
        <Card><CardBody>Column 2</CardBody></Card>
      </>
    ),
  },
};

export const ThreeColumns: Story = {
  args: {
    cols: 3,
    gap: 4,
    children: (
      <>
        <Card><CardBody>1</CardBody></Card>
        <Card><CardBody>2</CardBody></Card>
        <Card><CardBody>3</CardBody></Card>
      </>
    ),
  },
};
