import styled from "styled-components";
import { motion } from "framer-motion";
import React, { useState } from "react";
import "./styles.css";

const Slider = styled.div`
  width: 200px;
  height: 100px;
  overflow: hidden;
`;

const Wrapper = styled(motion.div)`
  display: flex;
  width: 500%;
  height: 100%;
`;

const Slide = styled.div`
  width: 100%;
  height: 100%;
  background: lightblue;

  &.alt {
    background: lightcoral;
  }
`;

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

enum Direction {
  Back,
  Forward
}

export default function App() {
  const [position, setPosition] = useState<number>(0);

  const paginate = (direction: Direction) => {
    if (direction === Direction.Forward) {
      setPosition(prevPosition => {
        if (prevPosition >= -600) {
          return prevPosition - 200;
        }
        return prevPosition;
      });
    } else { // Direction.Back
      setPosition(prevPosition => {
        if (prevPosition <= -200) {
          return prevPosition + 200;
        }
        return prevPosition;
      });
    }
  };

  const handleOnClick = () => {
    paginate(Direction.Forward);
  };

  return (
    <div className="App">
      <Slider>
        <Wrapper
          animate={{ x: position }}
          transition={{
            x: { duration: 1, type: "tween" }
          }}
          drag="x"
          dragConstraints={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);

            if (swipe < -swipeConfidenceThreshold) {
              paginate(Direction.Forward);
            } else if (swipe > swipeConfidenceThreshold) {
              paginate(Direction.Back);
            }
          }}
        >
          <Slide>1/5</Slide>
          <Slide className="alt">2/5</Slide>
          <Slide>3/5</Slide>
          <Slide className="alt">4/5</Slide>
          <Slide>5/5</Slide>
        </Wrapper>
      </Slider>
      <button
        disabled={position === 0}
        onClick={() => paginate(Direction.Back)}
      >
        prev
      </button>
      <button
        disabled={position === -800}
        onClick={() => paginate(Direction.Forward)}
      >
        next
      </button>
    </div>
  );
}
