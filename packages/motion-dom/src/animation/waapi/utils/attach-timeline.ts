export function attachTimeline(animation: Animation, timeline: any) {
    animation.timeline = timeline
    animation.onfinish = null
}
