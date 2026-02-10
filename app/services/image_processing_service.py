from PIL import Image


PALETTE = [
    (255, 255, 255),  # white
    (0, 0, 0),        # black
    (255, 0, 0),      # red
    (0, 255, 0),      # green
    (255, 255, 0),    # yellow
    (0, 0, 255),      # blue
]


def _nearest_color(r, g, b):
    best = PALETTE[0]
    best_dist = 10**9
    for pr, pg, pb in PALETTE:
        dr = r - pr
        dg = g - pg
        db = b - pb
        dist = dr * dr + dg * dg + db * db
        if dist < best_dist:
            best_dist = dist
            best = (pr, pg, pb)
    return best


def apply_color_diffusion(image):
    """
    Floyd-Steinberg error diffusion with fixed 6-color palette.
    """
    img = image.convert("RGB")
    width, height = img.size
    pixels = img.load()

    # error buffers for current and next row
    err_curr = [[0.0, 0.0, 0.0] for _ in range(width + 2)]
    err_next = [[0.0, 0.0, 0.0] for _ in range(width + 2)]

    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            er, eg, eb = err_curr[x + 1]
            r = min(255, max(0, int(r + er)))
            g = min(255, max(0, int(g + eg)))
            b = min(255, max(0, int(b + eb)))

            nr, ng, nb = _nearest_color(r, g, b)
            pixels[x, y] = (nr, ng, nb)

            dr = r - nr
            dg = g - ng
            db = b - nb

            # Floyd-Steinberg weights
            # right
            err_curr[x + 2][0] += dr * 7 / 16
            err_curr[x + 2][1] += dg * 7 / 16
            err_curr[x + 2][2] += db * 7 / 16
            # down-left
            err_next[x][0] += dr * 3 / 16
            err_next[x][1] += dg * 3 / 16
            err_next[x][2] += db * 3 / 16
            # down
            err_next[x + 1][0] += dr * 5 / 16
            err_next[x + 1][1] += dg * 5 / 16
            err_next[x + 1][2] += db * 5 / 16
            # down-right
            err_next[x + 2][0] += dr * 1 / 16
            err_next[x + 2][1] += dg * 1 / 16
            err_next[x + 2][2] += db * 1 / 16

        err_curr, err_next = err_next, [[0.0, 0.0, 0.0] for _ in range(width + 2)]

    return img
