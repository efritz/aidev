export type InclusionReason =
    | { type: 'explicit' }
    | { type: 'tool_use'; toolUseClass: 'read' | 'write'; toolUseId: string }
    | { type: 'editor'; currentlyOpen: boolean }

export function updateInclusionReasons(reasons: InclusionReason[], reason: InclusionReason) {
    if (
        (reason.type === 'explicit' && reasons.some(r => r.type === 'explicit')) ||
        (reason.type === 'tool_use' &&
            reasons.some(
                r =>
                    r.type === 'tool_use' && r.toolUseClass === reason.toolUseClass && r.toolUseId === reason.toolUseId,
            ))
    ) {
        // Already exists
        return
    }

    if (reason.type === 'editor') {
        const matching = reasons.find(r => r.type === 'editor')
        if (matching) {
            // Update in-place
            matching.currentlyOpen = reason.currentlyOpen
            return
        }
    }

    // No matching reasons exist
    reasons.push(reason)
}
