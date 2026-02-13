"use client";

import { useEffect, useRef } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

interface TourProps {
    steps: DriveStep[];
    tourKey: string;
    onFinish?: () => void;
    runDelay?: number;
}

export function Tour({ steps, tourKey, onFinish, runDelay = 1500 }: TourProps) {
    const driverObj = useRef<ReturnType<typeof driver> | null>(null);

    useEffect(() => {
        // Check if tour has already been seen
        const hasSeenTour = localStorage.getItem(tourKey);
        if (hasSeenTour) return;

        // Initialize driver
        driverObj.current = driver({
            showProgress: true,
            animate: true,
            doneBtnText: "Done",
            nextBtnText: "Next",
            prevBtnText: "Previous",
            steps: steps,
            onDestroyed: () => {
                // Mark tour as seen when finished or skipped
                localStorage.setItem(tourKey, "true");
                if (onFinish) onFinish();
            },
        });

        // innovative trigger: check if valid elements exist before starting
        // small delay to ensure rendering
        const t = setTimeout(() => {
            driverObj.current?.drive();
        }, runDelay);

        return () => clearTimeout(t);
    }, [steps, tourKey, onFinish, runDelay]);

    return null;
}
