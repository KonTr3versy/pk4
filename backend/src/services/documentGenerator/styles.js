/**
 * Document Styles
 *
 * Shared styles for all generated documents
 */

const { convertInchesToTwip } = require('docx');

// Color palette
const COLORS = {
  primary: '7C3AED',      // Purple
  secondary: '6B7280',    // Gray
  success: '10B981',      // Green
  warning: 'F59E0B',      // Yellow
  danger: 'EF4444',       // Red
  info: '3B82F6',         // Blue
  dark: '1F2937',         // Dark gray
  light: 'F3F4F6',        // Light gray
  white: 'FFFFFF',
  black: '000000'
};

// Font settings
const FONTS = {
  heading: 'Arial',
  body: 'Arial',
  mono: 'Courier New'
};

// Page settings (US Letter)
const PAGE_SIZE = {
  width: convertInchesToTwip(8.5),
  height: convertInchesToTwip(11)
};

const PAGE_MARGINS = {
  top: convertInchesToTwip(1),
  right: convertInchesToTwip(1),
  bottom: convertInchesToTwip(1),
  left: convertInchesToTwip(1)
};

// Paragraph styles
const paragraphStyles = [
  {
    id: 'Title',
    name: 'Title',
    basedOn: 'Normal',
    next: 'Normal',
    run: {
      font: FONTS.heading,
      size: 48,
      bold: true,
      color: COLORS.primary
    },
    paragraph: {
      spacing: { before: 0, after: 400 },
      alignment: 'center'
    }
  },
  {
    id: 'Subtitle',
    name: 'Subtitle',
    basedOn: 'Normal',
    run: {
      font: FONTS.heading,
      size: 28,
      color: COLORS.secondary
    },
    paragraph: {
      spacing: { before: 0, after: 300 },
      alignment: 'center'
    }
  },
  {
    id: 'Heading1',
    name: 'Heading 1',
    basedOn: 'Normal',
    next: 'Normal',
    run: {
      font: FONTS.heading,
      size: 32,
      bold: true,
      color: COLORS.dark
    },
    paragraph: {
      spacing: { before: 400, after: 200 }
    }
  },
  {
    id: 'Heading2',
    name: 'Heading 2',
    basedOn: 'Normal',
    next: 'Normal',
    run: {
      font: FONTS.heading,
      size: 28,
      bold: true,
      color: COLORS.dark
    },
    paragraph: {
      spacing: { before: 300, after: 150 }
    }
  },
  {
    id: 'Heading3',
    name: 'Heading 3',
    basedOn: 'Normal',
    next: 'Normal',
    run: {
      font: FONTS.heading,
      size: 24,
      bold: true,
      color: COLORS.secondary
    },
    paragraph: {
      spacing: { before: 200, after: 100 }
    }
  },
  {
    id: 'Normal',
    name: 'Normal',
    run: {
      font: FONTS.body,
      size: 22
    },
    paragraph: {
      spacing: { after: 120 }
    }
  },
  {
    id: 'TableHeader',
    name: 'Table Header',
    basedOn: 'Normal',
    run: {
      font: FONTS.body,
      size: 20,
      bold: true,
      color: COLORS.white
    }
  },
  {
    id: 'TableCell',
    name: 'Table Cell',
    basedOn: 'Normal',
    run: {
      font: FONTS.body,
      size: 20
    }
  },
  {
    id: 'Code',
    name: 'Code',
    basedOn: 'Normal',
    run: {
      font: FONTS.mono,
      size: 18
    },
    paragraph: {
      spacing: { before: 100, after: 100 }
    }
  }
];

// Table border style
const tableBorder = {
  style: 'single',
  size: 1,
  color: 'CCCCCC'
};

const tableBorders = {
  top: tableBorder,
  bottom: tableBorder,
  left: tableBorder,
  right: tableBorder,
  insideHorizontal: tableBorder,
  insideVertical: tableBorder
};

// Severity colors for findings
const SEVERITY_COLORS = {
  critical: COLORS.danger,
  high: 'DC2626',
  medium: COLORS.warning,
  low: COLORS.info,
  info: COLORS.secondary
};

// Status colors
const STATUS_COLORS = {
  open: COLORS.danger,
  in_progress: COLORS.warning,
  complete: COLORS.success,
  wont_fix: COLORS.secondary
};

// Detection outcome colors
const OUTCOME_COLORS = {
  prevented: COLORS.success,
  alerted: COLORS.warning,
  logged: COLORS.info,
  not_logged: COLORS.danger
};

module.exports = {
  COLORS,
  FONTS,
  PAGE_SIZE,
  PAGE_MARGINS,
  paragraphStyles,
  tableBorders,
  SEVERITY_COLORS,
  STATUS_COLORS,
  OUTCOME_COLORS
};
