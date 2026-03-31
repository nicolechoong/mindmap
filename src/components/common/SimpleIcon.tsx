import React from 'react';

/**
 * Standardized "Clip Art" style icons (Line Art).
 * Consistent stroke weight and minimalist design based on user provided style.
 */

interface SimpleIconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    strokeWidth?: number;
}

const SimpleIcon: React.FC<SimpleIconProps> = ({ 
    size = 18, 
    strokeWidth = 2, 
    children, 
    ...props 
}) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={strokeWidth} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
    >
        {children}
    </svg>
);

export const IconUndo = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </SimpleIcon>
);

export const IconRedo = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M21 7v6h-6" />
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </SimpleIcon>
);

export const IconPlus = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M12 5v14M5 12h14" />
    </SimpleIcon>
);

export const IconMinus = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M5 12h14" />
    </SimpleIcon>
);

export const IconX = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M18 6L6 18M6 6l12 12" />
    </SimpleIcon>
);

export const IconSibling = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
    </SimpleIcon>
);

export const IconFit = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M15 3h6v6" />
        <path d="M9 21H3v-6" />
        <path d="M21 3l-7 7" />
        <path d="M3 21l7-7" />
    </SimpleIcon>
);

export const IconTidy = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
    </SimpleIcon>
);

export const IconCurve = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M3 12c0-8.5 18-8.5 18 0s-18 8.5-18 8.5" />
    </SimpleIcon>
);

export const IconOrtho = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M3 12h18V6H3v12z" />
        <path d="M12 3v18" />
    </SimpleIcon>
); // Placeholder for ortho connection style icon

export const IconCornerDownRight = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M15 10l5 5-5 5" />
        <path d="M4 4v7a4 4 0 0 0 4 4h12" />
    </SimpleIcon>
);

export const IconStraight = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M5 12l14 0" />
        <path d="M12 5l0 14" strokeOpacity="0.1" /> 
    </SimpleIcon>
);

export const IconAnchorAdjust = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M12 3v18" />
        <path d="M3 12h18" />
        <circle cx="12" cy="12" r="3" />
    </SimpleIcon>
);

export const IconCalendar = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </SimpleIcon>
);

export const IconMenu = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="18" x2="20" y2="18" />
    </SimpleIcon>
);

export const IconEye = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </SimpleIcon>
);

export const IconEyeOff = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </SimpleIcon>
);

export const IconArrowLeft = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
    </SimpleIcon>
);

export const IconArrowRight = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="m12 5 7 7-7 7" />
        <path d="M5 12h14" />
    </SimpleIcon>
);

export const IconArrowUp = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="m5 12 7-7 7 7" />
        <path d="M12 19V5" />
    </SimpleIcon>
);

export const IconArrowDown = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="m19 12-7 7-7-7" />
        <path d="M12 5v14" />
    </SimpleIcon>
);

export const IconChevronLeft = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="m15 18-6-6 6-6" />
    </SimpleIcon>
);

export const IconChevronRight = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="m9 18 6-6-6-6" />
    </SimpleIcon>
);

export const IconCheck = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <polyline points="20 6 9 17 4 12" />
    </SimpleIcon>
);

export const IconPaperclip = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </SimpleIcon>
);

export const IconLink = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </SimpleIcon>
);

export const IconTrash = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </SimpleIcon>
);

export const IconCircle = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <circle cx="12" cy="12" r="10" />
    </SimpleIcon>
);

export const IconExternalLink = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
    </SimpleIcon>
);

export const IconPencil = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </SimpleIcon>
);

export const IconBrain = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.97-2.02 2.5 2.5 0 0 1-2.42-1.33 2.5 2.5 0 0 1 0-3.18 2.5 2.5 0 0 1 2.42-1.33 2.5 2.5 0 0 1 2.97-2.02A2.5 2.5 0 0 1 9.5 2z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.97-2.02 2.5 2.5 0 0 0 2.42-1.33 2.5 2.5 0 0 0 0-3.18 2.5 2.5 0 0 0-2.42-1.33 2.5 2.5 0 0 0-2.97-2.02A2.5 2.5 0 0 0 14.5 2z" />
    </SimpleIcon>
);

export const IconFolder = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </SimpleIcon>
);

export const IconAlertTriangle = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="m10.29 3.86 7.92 13.17a1.73 1.73 0 0 1-1.49 2.63h-15.84a1.73 1.73 0 0 1-1.49-2.63l7.92-13.17a1.73 1.73 0 0 1 2.98 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </SimpleIcon>
);

export const IconMoreVertical = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
    </SimpleIcon>
);

export const IconSun = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </SimpleIcon>
);

export const IconMoon = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </SimpleIcon>
);

export const IconKeyboard = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
        <line x1="6" y1="9" x2="6" y2="9" />
        <line x1="10" y1="9" x2="10" y2="9" />
        <line x1="14" y1="9" x2="14" y2="9" />
        <line x1="18" y1="9" x2="18" y2="9" />
        <line x1="6" y1="13" x2="6" y2="13" />
        <line x1="10" y1="13" x2="10" y2="13" />
        <line x1="14" y1="13" x2="14" y2="13" />
        <line x1="18" y1="13" x2="18" y2="13" />
        <line x1="7" y1="17" x2="17" y2="17" />
    </SimpleIcon>
);

export const IconFile = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
    </SimpleIcon>
);

export const IconSettings = (props: SimpleIconProps) => (
    <SimpleIcon {...props}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </SimpleIcon>
);
