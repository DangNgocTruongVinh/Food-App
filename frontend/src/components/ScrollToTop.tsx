import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { shouldScrollToTop } from "../utils/navigation";

/** Đưa trang về đầu khi chuyển route (xem quy tắc trong shouldScrollToTop). */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigation = useNavigationType();
  const previousPath = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (shouldScrollToTop(previousPath.current, pathname, navigation)) window.scrollTo(0, 0);
    previousPath.current = pathname;
  }, [navigation, pathname]);

  return null;
}
