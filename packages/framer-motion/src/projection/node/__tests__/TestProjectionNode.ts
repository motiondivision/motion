import { Box } from "motion-utils"
import { createProjectionNode } from "../create-projection-node"
import { IProjectionNode, ProjectionNodeOptions } from "../types"

let rootNode: IProjectionNode

export const TestRootNode = createProjectionNode<{}>({
    measureScroll: (_instance) => ({ x: 0, y: 0 }),
    checkIsScrollRoot: () => true,
})

interface TestInstance {
    resetTransform?: () => void
    box?: Box
}

export const TestProjectionNode = createProjectionNode<TestInstance>({
    measureScroll: (_instance) => ({ x: 0, y: 0 }),
    defaultParent: () => {
        if (!rootNode) {
            rootNode = new TestRootNode() as any
        }

        return rootNode
    },
    resetTransform: (instance) =>
        instance.resetTransform ? instance.resetTransform() : undefined,
    checkIsScrollRoot: () => false,
})

export function createTestNode(
    parent?: any,
    options?: ProjectionNodeOptions,
    latestValues: any = {}
) {
    const testNode = new TestProjectionNode(latestValues, parent)
    testNode.setOptions({
        ...options,
    })
    return testNode
}
