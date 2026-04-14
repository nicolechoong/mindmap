def measure(text):
    # more realistic widths for Arial 15px bold
    widths = {
        'B': 11, 'u': 9, 's': 8, 'i': 4, 'n': 9, 'e': 9, 't': 5,
        'A': 11, 'a': 9, 'l': 4, 'y': 8, ' ': 4,
        '(': 5, ')': 5, 'K': 11, 'v': 8, 'H': 11, 'w': 11
    }
    w = 0
    for c in text:
        if c == '\n': continue
        w += widths.get(c, 8)
    return w

def wrap_text(text, max_width):
    if not text or not text.strip(): return text
    
    import re
    words = re.split(r'(\s+)', text)
    result = ''
    current_line = ''
    
    for word in words:
        if not word: continue
        if measure(word) > max_width:
            for char in word:
                test_line = current_line + char
                if measure(test_line) > max_width and current_line != '':
                    result += current_line + '\n'
                    current_line = char
                else:
                    current_line = test_line
        else:
            test_line = current_line + word
            if measure(test_line) > max_width and current_line.strip() != '':
                import re
                result += re.sub(r'\s+$', '', current_line) + '\n'
                current_line = word.lstrip()
            else:
                current_line = test_line
    result += current_line
    return result

print('Width of "Business Analyst (Kevin ":', measure("Business Analyst (Kevin "))
print('Width of "Business Analyst (Kevin Hew)":', measure("Business Analyst (Kevin Hew)"))
print('Width of "(Kevin Hew)":', measure("(Kevin Hew)"))
print('164:', repr(wrap_text('Business Analyst (Kevin Hew)', 164)))
