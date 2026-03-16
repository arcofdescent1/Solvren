import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageHeader } from "./page-header";
import { Button } from "../primitives/button";

const meta = {
  title: "Layout/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Page Title",
    description: "Optional description for the page.",
  },
};

export const WithActions: Story = {
  args: {
    title: "Dashboard",
    description: "Overview of your organization.",
    right: (
      <>
        <Button variant="outline" size="sm">
          Secondary
        </Button>
        <Button size="sm">Primary Action</Button>
      </>
    ),
  },
};
