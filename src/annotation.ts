// [VexFlow](https://vexflow.com) - Copyright (c) Mohit Muthanna 2010.
// MIT License
import { Element } from './element';
import { FontInfo, log, ModifierContextState, StemmableNote, TextFormatter } from './index';
import { Modifier, ModifierPosition } from './modifier';
import { Stave } from './stave';
import { Stem } from './stem';
import { Tables } from './tables';

// eslint-disable-next-line
function L(...args: any[]) {
  if (Annotation.DEBUG) log('Vex.Flow.Annotation', args);
}

export enum AnnotationHorizontalJustify {
  LEFT = 1,
  CENTER = 2,
  RIGHT = 3,
  CENTER_STEM = 4,
}

export enum AnnotationVerticalJustify {
  TOP = 1,
  CENTER = 2,
  BOTTOM = 3,
  CENTER_STEM = 4,
}

/**
 * Annotations are modifiers that can be attached to
 * notes.
 *
 * See `tests/annotation_tests.ts` for usage examples.
 */
export class Annotation extends Modifier {
  /** To enable logging for this class. Set `Vex.Flow.Annotation.DEBUG` to `true`. */
  static DEBUG: boolean = false;

  /** Annotations category string. */
  static get CATEGORY(): string {
    return 'Annotation';
  }

  static TEXT_FONT: Required<FontInfo> = { ...Element.TEXT_FONT };

  /** Text annotations can be positioned and justified relative to the note. */
  static HorizontalJustify = AnnotationHorizontalJustify;

  static HorizontalJustifyString: Record<string, number> = {
    left: AnnotationHorizontalJustify.LEFT,
    right: AnnotationHorizontalJustify.RIGHT,
    center: AnnotationHorizontalJustify.CENTER,
    centerStem: AnnotationHorizontalJustify.CENTER_STEM,
  };

  static VerticalJustify = AnnotationVerticalJustify;

  static VerticalJustifyString: Record<string, number> = {
    above: AnnotationVerticalJustify.TOP,
    top: AnnotationVerticalJustify.TOP,
    below: AnnotationVerticalJustify.BOTTOM,
    bottom: AnnotationVerticalJustify.BOTTOM,
    center: AnnotationVerticalJustify.CENTER,
    centerStem: AnnotationVerticalJustify.CENTER_STEM,
  };

  /** Arrange annotations within a `ModifierContext` */
  static format(annotations: Annotation[], state: ModifierContextState): boolean {
    if (!annotations || annotations.length === 0) return false;

    let width = 0;
    for (let i = 0; i < annotations.length; ++i) {
      const annotation = annotations[i];
      const textFormatter = TextFormatter.create(annotation.textFont);
      // Text height is expressed in fractional stave spaces.
      const textLines = (5 + textFormatter.maxHeight) / Tables.STAVE_LINE_DISTANCE;
      let verticalSpaceNeeded = textLines;

      const note = annotation.checkAttachedNote();
      const stave: Stave | undefined = note.getStave();
      const stemDirection = note.hasStem() ? note.getStemDirection() : Stem.UP;
      let stemHeight = 0;
      let lines = 5;
      if (note instanceof StemmableNote) {
        const stem = (note as StemmableNote).getStem();
        if (stem) {
          stemHeight = Math.abs(stem.getHeight()) / Tables.STAVE_LINE_DISTANCE;
        }
      }
      if (stave) {
        lines = stave.getNumLines();
      }
      // Get the text width from the font metrics.
      const textWidth = textFormatter.getWidthForTextInPx(annotation.text);
      width = Math.max(width, textWidth);

      if (annotation.verticalJustification === this.VerticalJustify.TOP) {
        let noteLine = note.getLineNumber(true);
        if (stemDirection === Stem.UP) {
          noteLine += stemHeight;
        }
        const curTop = noteLine + state.top_text_line + 0.5;
        if (curTop < lines) {
          annotation.setTextLine(lines - noteLine);
          verticalSpaceNeeded += lines - noteLine;
          state.top_text_line = verticalSpaceNeeded;
        } else {
          annotation.setTextLine(state.top_text_line);
          state.top_text_line += verticalSpaceNeeded;
        }
      } else if (annotation.verticalJustification === this.VerticalJustify.BOTTOM) {
        let noteLine = lines - note.getLineNumber();
        if (stemDirection === Stem.DOWN) {
          noteLine += stemHeight;
        }
        const curBottom = noteLine + state.text_line + 1;
        if (curBottom < lines) {
          annotation.setTextLine(lines - curBottom);
          verticalSpaceNeeded += lines - curBottom;
          state.text_line = verticalSpaceNeeded;
        } else {
          annotation.setTextLine(state.text_line);
          state.text_line += verticalSpaceNeeded;
        }
      } else {
        annotation.setTextLine(state.text_line);
      }
    }
    state.left_shift += width / 2;
    state.right_shift += width / 2;
    return true;
  }

  protected horizontalJustification: AnnotationHorizontalJustify;
  protected verticalJustification: AnnotationVerticalJustify;
  protected text: string;

  /**
   * Annotations inherit from `Modifier` and is positioned correctly when
   * in a `ModifierContext`.
   * Create a new `Annotation` with the string `text`.
   */
  constructor(text: string) {
    super();

    this.text = text;
    this.horizontalJustification = AnnotationHorizontalJustify.CENTER;
    // warning: the default in the constructor is TOP, but in the factory the default is BOTTOM.
    // this is to support legacy application that may expect this.
    this.verticalJustification = AnnotationVerticalJustify.TOP;
    this.resetFont();

    // The default width is calculated from the text.
    this.setWidth(Tables.textWidth(text));
  }
  setPosition(position: string | number): this {
    return super.setPosition(position);
  }

  /**
   * Set vertical position of text (above or below stave).
   * @param just value in `AnnotationVerticalJustify`.
   */
  setVerticalJustification(just: string | AnnotationVerticalJustify): this {
    this.verticalJustification = typeof just === 'string' ? Annotation.VerticalJustifyString[just] : just;
    return this;
  }

  /**
   * Get horizontal justification.
   */
  getJustification(): AnnotationHorizontalJustify {
    return this.horizontalJustification;
  }

  /**
   * Set horizontal justification.
   * @param justification value in `Annotation.Justify`.
   */
  setJustification(just: string | AnnotationHorizontalJustify): this {
    this.horizontalJustification = typeof just === 'string' ? Annotation.HorizontalJustifyString[just] : just;
    return this;
  }

  /** Render text beside the note. */
  draw(): void {
    const ctx = this.checkContext();
    const note = this.checkAttachedNote();
    const stemDirection = note.hasStem() ? note.getStemDirection() : Stem.UP;
    const textFormatter = TextFormatter.create(this.textFont);
    const start = note.getModifierStartXY(ModifierPosition.ABOVE, this.index);

    this.setRendered();

    // We're changing context parameters. Save current state.
    ctx.save();
    const classString = Object.keys(this.getAttribute('classes')).join(' ');
    ctx.openGroup(classString, this.getAttribute('id'));
    ctx.setFont(this.textFont);

    const text_width = ctx.measureText(this.text).width;
    const text_height = textFormatter.maxHeight + 2;
    let x;
    let y;

    if (this.horizontalJustification === AnnotationHorizontalJustify.LEFT) {
      x = start.x;
    } else if (this.horizontalJustification === AnnotationHorizontalJustify.RIGHT) {
      x = start.x - text_width;
    } else if (this.horizontalJustification === AnnotationHorizontalJustify.CENTER) {
      x = start.x - text_width / 2;
    } /* CENTER_STEM */ else {
      x = (note as StemmableNote).getStemX() - text_width / 2;
    }

    let stem_ext: Record<string, number> = {};
    let spacing = 0;
    const has_stem = note.hasStem();
    const stave = note.checkStave();

    // The position of the text varies based on whether or not the note
    // has a stem.
    if (has_stem) {
      stem_ext = (note as StemmableNote).checkStem().getExtents();
      spacing = stave.getSpacingBetweenLines();
    }

    if (this.verticalJustification === AnnotationVerticalJustify.BOTTOM) {
      // HACK: We need to compensate for the text's height since its origin
      // is bottom-right.
      y = note.getYs()[0] + (this.text_line + 1) * Tables.STAVE_LINE_DISTANCE + text_height;
      if (has_stem && stemDirection === Stem.DOWN) {
        y = Math.max(y, stem_ext.topY + text_height + spacing * this.text_line);
      }
    } else if (this.verticalJustification === AnnotationVerticalJustify.CENTER) {
      const yt = note.getYForTopText(this.text_line) - 1;
      const yb = stave.getYForBottomText(this.text_line);
      y = yt + (yb - yt) / 2 + text_height / 2;
    } else if (this.verticalJustification === AnnotationVerticalJustify.TOP) {
      y = note.getYs()[0] - (this.text_line + 1) * Tables.STAVE_LINE_DISTANCE;
      if (has_stem && stemDirection === Stem.UP) {
        y = Math.min(y, stem_ext.topY - spacing * (this.text_line + 1));
      }
    } /* CENTER_STEM */ else {
      const extents = note.getStemExtents();
      y = extents.topY + (extents.baseY - extents.topY) / 2 + text_height / 2;
    }

    L('Rendering annotation: ', this.text, x, y);
    ctx.fillText(this.text, x, y);
    ctx.closeGroup();
    ctx.restore();
  }
}
