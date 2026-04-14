const measureText = (text) => {
    // mock width by character count * 7 (approx 13px font)
    return { width: text.length * 7 };
}

function wrapTextWithNewlines(text, maxWidth) {
    if (!text || !text.trim()) return text;

    const words = text.split(/(\s+)/);
    let result = '';
    let currentLine = '';

    for (const word of words) {
        if (measureText(word).width > maxWidth) {
            for (const char of word) {
                const testLine = currentLine + char;
                if (measureText(testLine).width > maxWidth && currentLine !== '') {
                    result += currentLine + '\n';
                    currentLine = char;
                } else {
                    currentLine = testLine;
                }
            }
        } else {
            const testLine = currentLine + word;
            if (measureText(testLine).width > maxWidth && currentLine.trim() !== '') {
                result += currentLine.replace(/\s+$/, '') + '\n';
                currentLine = word.trimStart();
            } else {
                currentLine = testLine;
            }
        }
    }
    result += currentLine;
    return result;
}

console.log("MaxWidth=164:", JSON.stringify(wrapTextWithNewlines("Business Analyst (Kevin Hew)", 164)));
console.log("MaxWidth=184:", JSON.stringify(wrapTextWithNewlines("Business Analyst (Kevin Hew)", 184)));
console.log("MaxWidth=130:", JSON.stringify(wrapTextWithNewlines("Business Analyst (Kevin Hew)", 130)));
