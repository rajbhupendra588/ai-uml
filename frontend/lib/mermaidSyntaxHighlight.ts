// Custom syntax highlighter for Mermaid code
// Color-codes different entity types for better visual organization

export interface HighlightedToken {
    type: 'keyword' | 'entity' | 'relationship' | 'property' | 'string' | 'comment' | 'default';
    text: string;
}

export function tokenizeMermaidCode(code: string): HighlightedToken[] {
    const tokens: HighlightedToken[] = [];
    const lines = code.split('\n');

    for (const line of lines) {
        // Skip empty lines
        if (!line.trim()) {
            tokens.push({ type: 'default', text: line + '\n' });
            continue;
        }

        // Comments
        if (line.trim().startsWith('%%')) {
            tokens.push({ type: 'comment', text: line + '\n' });
            continue;
        }

        // Keywords (diagram types, directions, etc.)
        const keywordPattern = /^(\s*)(graph|flowchart|classDiagram|sequenceDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|C4Context|quadrantChart|requirementDiagram|componentDiagram|deploymentDiagram|architecture|TD|TB|BT|RL|LR|class|note|participant|actor|loop|alt|opt|par|rect|activate|deactivate|state|choice|fork|join)\b/i;

        if (keywordPattern.test(line)) {
            const match = line.match(keywordPattern);
            if (match) {
                tokens.push({ type: 'default', text: match[1] }); // whitespace
                tokens.push({ type: 'keyword', text: match[2] });
                tokens.push({ type: 'default', text: line.substring(match[0].length) + '\n' });
                continue;
            }
        }

        // Entity definitions (nodes, classes, participants, etc.)
        // Pattern: ID[Label], ID(Label), ID{Label}, ID((Label)), etc.
        const entityPattern = /([A-Za-z0-9_]+)([\[\(\{<].*?[\]\)\}>])/g;
        let lastIndex = 0;
        let hasMatch = false;
        let lineRemainder = line;

        const matches = Array.from(line.matchAll(entityPattern));
        if (matches.length > 0) {
            hasMatch = true;
            for (const match of matches) {
                const beforeMatch = line.substring(lastIndex, match.index);
                if (beforeMatch) {
                    tokens.push({ type: 'default', text: beforeMatch });
                }
                tokens.push({ type: 'entity', text: match[1] }); // entity ID
                tokens.push({ type: 'property', text: match[2] }); // entity shape/label
                lastIndex = match.index! + match[0].length;
            }
            lineRemainder = line.substring(lastIndex);
        }

        // Relationships/connections -->  --\u003e  -.->  ==\u003e  etc.
        const relationshipPattern = /(--\u003e|---\u003e|--|-\.-\u003e|==\u003e|==-|\.\.->|-\.-|-\.\.-)/g;
        if (!hasMatch && relationshipPattern.test(lineRemainder)) {
            const parts = lineRemainder.split(relationshipPattern);
            for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 0) {
                    // Check if this part contains an entity
                    const entityMatch = parts[i].match(/^([A-Za-z0-9_]+)/);
                    if (entityMatch) {
                        tokens.push({ type: 'entity', text: entityMatch[1] });
                        tokens.push({ type: 'default', text: parts[i].substring(entityMatch[1].length) });
                    } else {
                        tokens.push({ type: 'default', text: parts[i] });
                    }
                } else {
                    tokens.push({ type: 'relationship', text: parts[i] });
                }
            }
            tokens.push({ type: 'default', text: '\n' });
            continue;
        }

        // If no specific pattern matched, add the remainder as default
        if (hasMatch) {
            tokens.push({ type: 'default', text: lineRemainder + '\n' });
        } else if (!hasMatch) {
            tokens.push({ type: 'default', text: line + '\n' });
        }
    }

    return tokens;
}

export const SYNTAX_COLORS = {
    keyword: {
        light: '#7c3aed', // purple-600
        dark: '#a78bfa',  // purple-400
    },
    entity: {
        light: '#2563eb', // blue-600
        dark: '#60a5fa',  // blue-400
    },
    relationship: {
        light: '#64748b', // slate-600
        dark: '#94a3b8',  // slate-400
    },
    property: {
        light: '#059669', // emerald-600
        dark: '#34d399',  // emerald-400
    },
    string: {
        light: '#d97706', // amber-600
        dark: '#fbbf24',  // amber-400
    },
    comment: {
        light: '#9ca3af', // gray-400
        dark: '#6b7280',  // gray-500
    },
    default: {
        light: '#1e293b', // slate-800
        dark: '#e2e8f0',  // slate-200
    },
};
