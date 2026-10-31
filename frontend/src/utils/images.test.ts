import { describe, expect, it } from "vitest";
import { IMAGE_WIDTHS, optimizedImageUrl } from "./images";

const cloud = "https://res.cloudinary.com/nouri-cloud/image/upload/v1730000000/nouri/recipes/abc.jpg";

describe("optimizedImageUrl", () => {
  it("adds f_auto, q_auto and a width limit to Cloudinary images", () => {
    expect(optimizedImageUrl(cloud, IMAGE_WIDTHS.card))
      .toBe("https://res.cloudinary.com/nouri-cloud/image/upload/f_auto,q_auto,c_limit,w_640/v1730000000/nouri/recipes/abc.jpg");
  });

  it("keeps local group images and other URLs unchanged", () => {
    expect(optimizedImageUrl("/assets/recipe-oats.jpg", 640)).toBe("/assets/recipe-oats.jpg");
    expect(optimizedImageUrl("https://example.com/image/upload/a.jpg", 640)).toBe("https://example.com/image/upload/a.jpg");
  });

  it("does not add the transformation twice", () => {
    const once = optimizedImageUrl(cloud, 640);
    expect(optimizedImageUrl(once, 1200)).toBe(once);
  });
});
