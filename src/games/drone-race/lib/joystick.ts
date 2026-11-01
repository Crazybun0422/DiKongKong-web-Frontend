// Native touch input only. Keep the shared flight physics and keyboard unchanged.
export function joystickInput(x: number, y: number) {
  const length = Math.hypot(x, y);
  const visual = length > 1 ? { x: x / length, y: y / length } : { x, y };
  const axis = (value: number, fullTravel: number) => {
    const amount = Math.max(0, Math.abs(value) - 0.045) / (fullTravel - 0.045);
    return Math.sign(value) * Math.pow(Math.min(1, amount), 0.85);
  };
  return { visual, steer: axis(visual.x, 0.9), lift: axis(visual.y, 0.68) };
}
