# Bug: Hover Detection Incorrect in Large Rooms After Camera Change

**Status:** Open
**Date:** 2026-04-12
**Severity:** High

## Summary

Hover detection does not account for large rooms with multiple camera positions. When the camera changes within a room, hover states report false/incorrect values because they still reference the previous camera/scene coordinates.

## Steps to Reproduce

1. Enter the Scumm Bar
2. Observe that hover states work correctly in the first scene (the main bar area)
3. Walk behind the curtain to the pirates area (camera shifts to a new scene within the same room)
4. Attempt to hover over objects in the pirates area
5. Hover states still correspond to the previous camera/scene position, not the current one

## Expected Behavior

Hover detection should update to reflect the current camera position within a large room. When the camera shifts to show a different part of the room, hover coordinates and hit-testing should be recalculated relative to the new camera viewport.

## Actual Behavior

Hover states remain locked to the first camera/scene position after entering a room. Any subsequent camera changes within the same room are not taken into account, causing hover detection to report incorrect results for all objects in the new camera view.

## Root Cause (Suspected)

The hover detection system likely calculates hit areas based on the initial camera position when a room is entered, and does not re-evaluate when the camera pans or shifts to a different section of a large room. The coordinate mapping between screen space and room space needs to account for the current camera offset.

## Affected Areas

- Scumm Bar (main bar → pirates behind curtain)
- Potentially any large room with multiple camera positions/scenes
