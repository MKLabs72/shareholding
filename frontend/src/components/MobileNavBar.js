// src/components/MobileNavBar.js
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FiBarChart2, FiList } from "react-icons/fi";
import { BiSolidPieChartAlt2 } from "react-icons/bi";
import { GiBlackHoleBolas } from "react-icons/gi";

export default function MobileNavBar() {
  const { pathname } = useLocation();

  const items = [
    { to: "/revamp", Icon: GiBlackHoleBolas },
    { to: "/stats", Icon: FiBarChart2 },
    { to: "/assets", Icon: FiList },
    { to: "/shareholding", Icon: BiSolidPieChartAlt2 },
  ];

  return (
    <nav className="mobile-nav sm:hidden">
      {items.map(({ to, Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`mobile-nav-link${active ? " active" : ""}`}
          >
            <Icon size={24} />
          </Link>
        );
      })}
    </nav>
  );
}
