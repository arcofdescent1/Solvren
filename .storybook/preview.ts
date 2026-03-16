import React from "react";
import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Design system theme",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: "centered",

    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#f2f6fc" },
        { name: "dark", value: "#0b1220" },
      ],
    },

    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: { width: "375px", height: "812px" },
        },
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
        },
        desktop: {
          name: "Desktop",
          styles: { width: "1440px", height: "900px" },
        },
      },
    },

    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo"
    }
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals?.theme as string) ?? "light";
      return React.createElement(
        "div",
        {
          "data-theme": theme,
          className: "min-h-[200px] p-6 bg-[var(--bg-app)] text-[var(--text)]",
        },
        React.createElement(Story)
      );
    },
  ],
};

export default preview;