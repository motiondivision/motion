import { checkReorder } from "../check-reorder"
import { Point, ItemData } from "../../types" // Adjusted path

describe("checkReorder with axis='y'", () => { // Assuming existing tests were for 'y' axis
    const order: ItemData<string>[] = [
        { value: "a", layout: { min: 0, max: 100 } }, // Assuming this is an Axis layout
        { value: "b", layout: { min: 110, max: 120 } },
        { value: "c", layout: { min: 130, max: 230 } },
    ]

    test("Return same array if velocity is 0", () => {
        const newOrder = checkReorder(order, "a", { x: 0, y: 116 }, { x: 0, y: 0 }, "y")
        expect(newOrder).toEqual(order)
    })

    test("Return same array if value not found", () => {
        // Velocity is also 0 here, but the primary check should be value not found
        const newOrder = checkReorder(order, "d", { x: 0, y: 116 }, { x: 0, y: 0 }, "y")
        expect(newOrder).toEqual(order)
    })

    test("Return same array if nextItem not found (due to being at end of list and moving further)", () => {
        const newOrder = checkReorder(order, "c", { x: 0, y: 300 }, { x: 0, y: 1 }, "y")
        expect(newOrder).toEqual(order)
    })

    test("Return same array if item hasn't moved enough", () => {
        // item a center is 50. item b center is 115.
        // item a moving right/down: item.layout.max (100) + offset.y (14) = 114.
        // nextItemCenter (b) is 115. 114 is not > 115.
        const newOrder = checkReorder(order, "a", { x: 0, y: 14 }, { x: 0, y: 1 }, "y")
        expect(newOrder).toEqual(order)
    })

    test("Return reordered array if item has moved right/down", () => {
        // item a moving right/down: item.layout.max (100) + offset.y (16) = 116.
        // nextItemCenter (b) is 115. 116 > 115. Reorder.
        const newOrder = checkReorder(order, "a", { x: 0, y: 16 }, { x: 0, y: 1 }, "y")
        expect(newOrder).not.toEqual(order)
        expect(newOrder[0].value).toBe("b")
        expect(newOrder[1].value).toBe("a")
    })

    test("Return reordered array if item has moved left/up", () => {
        // item b center is 115. item a center is 50.
        // item b moving left/up: item.layout.min (110) + offset.y (-61) = 49.
        // nextItemCenter (a) is 50. 49 < 50. Reorder.
        const newOrder = checkReorder(order, "b", { x: 0, y: -61 }, { x: 0, y: -1 }, "y")
        expect(newOrder).not.toEqual(order)
        expect(newOrder[0].value).toBe("b") // This should be a, b if b moved to a's spot
        expect(newOrder[1].value).toBe("a") // This should be a, b if b moved to a's spot
        // Corrected expectation: If 'b' moves into 'a's spot, 'a' becomes the first item.
        // The original test logic was:
        // expect(newOrder[0].value).toBe("b")
        // expect(newOrder[1].value).toBe("a")
        // This seems to imply b stays at 0 and a moves to 1. Let's trace:
        // order: [a,b,c]. Dragging b (index 1) left into a (index 0).
        // newOrder should be [b,a,c]. So newOrder[0] is b, newOrder[1] is a. This is correct.
        expect(newOrder[0].value).toBe("b")
        expect(newOrder[1].value).toBe("a")
    })
})

describe("checkReorder with axis='xy'", () => {
    const orderXY: ItemData<number>[] = [
        { value: 0, layout: { x: { min: 0, max: 50 }, y: { min: 0, max: 50 } } }, // Top-left
        { value: 1, layout: { x: { min: 50, max: 100 }, y: { min: 0, max: 50 } } }, // Top-right
        { value: 2, layout: { x: { min: 0, max: 50 }, y: { min: 50, max: 100 } } }, // Bottom-left
        { value: 3, layout: { x: { min: 50, max: 100 }, y: { min: 50, max: 100 } } }  // Bottom-right
    ];

    test("Return same array if velocity is {x: 0, y: 0}", () => {
        const newOrder = checkReorder(orderXY, 0, { x: 10, y: 10 }, { x: 0, y: 0 }, "xy");
        expect(newOrder).toEqual(orderXY);
    });

    test("Return same array if value not found", () => {
        const newOrder = checkReorder(orderXY, 5, { x: 10, y: 10 }, { x: 1, y: 1 }, "xy");
        expect(newOrder).toEqual(orderXY);
    });

    test("Return same array if item hasn't moved significantly into another item's area", () => {
        // Drag item 0 slightly, but not enough to enter center of another item's bounding box
        // Item 0 center: (25,25). With offset (5,5) -> (30,30).
        // Item 1 center: (75,25). Item 2 center: (25,75). Item 3 center: (75,75).
        // (30,30) is still within item 0's original box {x: {min:0,max:50}, y: {min:0,max:50}}.
        // The checkReorder for "xy" checks if the current item's *new center* overlaps with *any other item's box*.
        // Current item 0's new center is (25+5, 25+5) = (30,30).
        // Target item 1's box is x:[50,100], y:[0,50]. No overlap.
        // Target item 2's box is x:[0,50], y:[50,100]. No overlap.
        // Target item 3's box is x:[50,100], y:[50,100]. No overlap.
        const newOrder = checkReorder(orderXY, 0, { x: 5, y: 5 }, { x: 1, y: 1 }, "xy");
        expect(newOrder).toEqual(orderXY);
    });

    test("Reorder [0,1,2,3] to [3,1,2,0] when item 0 is dragged to item 3's position", () => {
        // Drag item 0 (original center at 25,25)
        // Offset needed to move its center to item 3's center (75,75) is x: 50, y: 50.
        // New center of item 0 will be (25+50, 25+50) = (75,75).
        // This new center (75,75) is within item 3's box: x:[50,100], y:[50,100].
        const newOrder = checkReorder(orderXY, 0, { x: 50, y: 50 }, { x: 1, y: 1 }, "xy");
        expect(newOrder).not.toEqual(orderXY);
        expect(newOrder.map(item => item.value)).toEqual([3, 1, 2, 0]);
    });

    test("Reorder [0,1,2,3] to [1,0,2,3] when item 0 is dragged to item 1's position", () => {
        // Drag item 0 (center at 25,25) to where item 1's center is (75,25)
        // Offset needed: x: 50, y: 0. New center of item 0: (75,25).
        // This new center (75,25) is within item 1's box: x:[50,100], y:[0,50].
        const newOrder = checkReorder(orderXY, 0, { x: 50, y: 0 }, { x: 1, y: 0 }, "xy");
        expect(newOrder).not.toEqual(orderXY);
        expect(newOrder.map(item => item.value)).toEqual([1, 0, 2, 3]);
    });

    test("Reorder [0,1,2,3] to [2,1,0,3] when item 0 is dragged to item 2's position", () => {
        // Drag item 0 (center at 25,25) to where item 2's center is (25,75)
        // Offset needed: x: 0, y: 50. New center of item 0: (25,75).
        // This new center (25,75) is within item 2's box: x:[0,50], y:[50,100].
        const newOrder = checkReorder(orderXY, 0, { x: 0, y: 50 }, { x: 0, y: 1 }, "xy");
        expect(newOrder).not.toEqual(orderXY);
        expect(newOrder.map(item => item.value)).toEqual([2, 1, 0, 3]);
    });

    test("Reorder [0,1,2,3] to [0,3,2,1] when item 1 is dragged to item 3's position", () => {
        // Drag item 1 (center at 75,25) to where item 3's center is (75,75)
        // Offset needed: x: 0, y: 50. New center of item 1: (75,75).
        // This new center (75,75) is within item 3's box: x:[50,100], y:[50,100].
        const newOrder = checkReorder(orderXY, 1, { x: 0, y: 50 }, { x: 0, y: 1 }, "xy");
        expect(newOrder).not.toEqual(orderXY);
        expect(newOrder.map(item => item.value)).toEqual([0, 3, 2, 1]);
    });
})
