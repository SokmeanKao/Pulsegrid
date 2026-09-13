"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
  Children,
  isValidElement,
} from "react";
import {
  GridStack,
  type GridStackOptions,
  type GridStackWidget,
} from "gridstack";
import { GripVertical } from "lucide-react";
import "gridstack/dist/gridstack.min.css";
import { loadLayout, mergeLayout, saveLayout } from "@/lib/gridstack/layout";
import { widgetHeight } from "@/lib/dashboard/registry";
import type { LayoutMode, WidgetType } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

export type GridItemSpec = {
  id: string;
  type?: WidgetType;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  minW?: number;
  minH?: number;
  maxH?: number;
};

export type GridStackBoardHandle = {
  applyLayoutMode: (mode: LayoutMode) => void;
  getGrid: () => GridStack | null;
};

type Props = {
  storageKey: string;
  defaults: GridItemSpec[];
  children: ReactNode;
  className?: string;
  options?: Partial<GridStackOptions>;
  onLayout?: () => void;
  onPersist?: (widgets: GridStackWidget[]) => void;
  editable?: boolean;
};

type GsItem = HTMLElement & { gridstackNode?: GridStackWidget };

/**
 * GridStack + React. Layout density uses fixed size profiles
 * (compact / normal / expanded) — no DOM content measurement.
 */
export const GridStackBoard = forwardRef<GridStackBoardHandle, Props>(
  function GridStackBoard(
    {
      storageKey,
      defaults,
      children,
      className,
      options,
      onLayout,
      onPersist,
      editable = true,
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<GridStack | null>(null);
    const editableRef = useRef(editable);
    const onLayoutRef = useRef(onLayout);
    const onPersistRef = useRef(onPersist);
    const defaultsRef = useRef(defaults);
    editableRef.current = editable;
    onLayoutRef.current = onLayout;
    onPersistRef.current = onPersist;
    defaultsRef.current = defaults;

    const persist = (grid: GridStack) => {
      const savedWidgets = grid.save(false) as GridStackWidget[];
      if (onPersistRef.current) {
        onPersistRef.current(savedWidgets);
      } else {
        saveLayout(storageKey, savedWidgets);
      }
      onLayoutRef.current?.();
    };

    const applyLayoutMode = (mode: LayoutMode) => {
      const grid = gridRef.current;
      if (!grid) return;

      grid.batchUpdate();
      (grid.getGridItems() as GsItem[]).forEach((item) => {
        const type =
          (item.dataset.widgetType as WidgetType | undefined) ||
          defaultsRef.current.find(
            (d) => d.id === String(item.getAttribute("gs-id")),
          )?.type;
        if (!type || !item.gridstackNode) return;
        const h = widgetHeight(type, mode);
        if (item.gridstackNode.h !== h) {
          grid.update(item, { h });
        }
      });
      grid.compact("compact", true);
      grid.batchUpdate(false);
      persist(grid);
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    };

    useImperativeHandle(ref, () => ({
      applyLayoutMode,
      getGrid: () => gridRef.current,
    }));

    useEffect(() => {
      const el = hostRef.current;
      if (!el) return;

      const existing = (el as HTMLDivElement & { gridstack?: GridStack })
        .gridstack;
      if (existing) {
        existing.destroy(false);
      }

      const saved = onPersistRef.current ? null : loadLayout(storageKey);
      const layout = mergeLayout(defaults as GridStackWidget[], saved);

      const grid = GridStack.init(
        {
          column: 12,
          cellHeight: 56,
          margin: 8,
          float: true,
          animate: true,
          staticGrid: false,
          disableDrag: !editable,
          disableResize: !editable,
          draggable: {
            handle: ".grid-stack-item-content",
            appendTo: "body",
            scroll: true,
          },
          resizable: { handles: "e, se, s, sw, w" },
          alwaysShowResizeHandle: editable,
          ...options,
        },
        el,
      );
      if (!grid) return;
      gridRef.current = grid;

      grid.getGridItems().forEach((item) => {
        if (!item.gridstackNode) {
          grid.makeWidget(item);
        } else {
          grid.prepareDragDrop(item, true);
        }
      });

      layout.forEach((w) => {
        const node = el.querySelector(
          `.grid-stack-item[gs-id="${w.id}"]`,
        ) as GsItem | null;
        if (!node) return;
        node.removeAttribute("gs-no-move");
        node.removeAttribute("gs-no-resize");
        node.removeAttribute("gs-locked");
        if (node.gridstackNode) {
          node.gridstackNode.noMove = false;
          node.gridstackNode.noResize = false;
          node.gridstackNode.locked = false;
        }
        const spec = defaults.find((d) => d.id === w.id);
        grid.update(node, {
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          ...(spec?.maxH != null ? { maxH: spec.maxH } : {}),
          ...(spec?.minH != null ? { minH: spec.minH } : {}),
        });
      });

      grid.enableMove(editable);
      grid.enableResize(editable);

      const onPersistEvent = () => {
        if (!editableRef.current) return;
        persist(grid);
      };

      grid.on("change", onPersistEvent);
      grid.on("resizestop", () => {
        onPersistEvent();
        window.dispatchEvent(new Event("resize"));
        onLayoutRef.current?.();
      });
      grid.on("dragstop", onPersistEvent);
      onLayoutRef.current?.();

      return () => {
        if (gridRef.current === grid) {
          grid.destroy(false);
          gridRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey, editable]);

    return (
      <div
        ref={hostRef}
        className={cn(
          "grid-stack w-full",
          !editable && "grid-stack--locked",
          editable && "grid-stack--editing",
          className,
        )}
      >
        {Children.map(children, (child) => {
          if (!isValidElement(child)) return child;
          const id = (child.props as { "data-grid-id"?: string })[
            "data-grid-id"
          ];
          if (!id) return child;
          const def = defaults.find((d) => d.id === id) ?? {
            id,
            x: 0,
            y: 0,
            w: 6,
            h: 4,
            minW: 3,
            minH: 2,
          };
          const attrs: Record<string, string> = {
            "gs-id": id,
            "gs-x": String(def.x ?? 0),
            "gs-y": String(def.y ?? 0),
            "gs-w": String(def.w ?? 6),
            "gs-h": String(def.h ?? 4),
            "gs-min-w": String(def.minW ?? 3),
            "gs-min-h": String(def.minH ?? 2),
          };
          if (def.maxH != null) attrs["gs-max-h"] = String(def.maxH);
          if (def.type) attrs["data-widget-type"] = def.type;
          return (
            <div key={id} className="grid-stack-item" {...attrs}>
              <div className="grid-stack-item-content !overflow-auto rounded-none bg-transparent">
                {child}
              </div>
            </div>
          );
        })}
      </div>
    );
  },
);

export function GridDragHandle({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "widget-drag-handle inline-flex cursor-grab select-none items-center px-1 text-xs opacity-60 active:cursor-grabbing",
        className,
      )}
      title="Drag to rearrange"
      aria-hidden
    >
      <GripVertical className="size-4" strokeWidth={1.75} />
    </span>
  );
}
