export type InclusionReason =
    | { type: 'explicit'; metaMessageId: string }
    | { type: 'tool_use'; toolUseId: string }
    | { type: 'editor'; currentlyOpen: boolean }
    | { type: 'stash_applied'; metaMessageId: string }

export function updateInclusionReasons(reasons: InclusionReason[], reason: InclusionReason) {
    if (reason.type === 'tool_use' && reasons.some(r => r.type === 'tool_use' && r.toolUseId === reason.toolUseId)) {
        if (true) {
            throw new Error("HUH This souldn't happen?")
        }
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
