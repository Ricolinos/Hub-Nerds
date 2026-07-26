"use client";

import { usePathname } from "next/navigation";
import { Column, Row } from "@once-ui-system/core";
import { Sidebar } from "@/components/explore/Sidebar";
import { ExploreSearchBar } from "@/components/explore/ExploreSearchBar";
import { DesignerSearchBar } from "@/components/explore/DesignerSearchBar";
import { ExploreSearchProvider } from "@/components/explore/SearchContext";

export default function ExplorarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFreelancers = pathname === "/explorar/freelancers";

  return (
    <ExploreSearchProvider>
      <Column fillWidth maxWidth="xl" paddingTop="32" paddingBottom="64" paddingX="24" gap="32" horizontal="center">
        <Row fillWidth gap="32" s={{ direction: "column" }}>
          <Sidebar />
          <Column flex={1} fillWidth gap="24">
            {isFreelancers ? <DesignerSearchBar /> : <ExploreSearchBar />}
            {children}
          </Column>
        </Row>
      </Column>
    </ExploreSearchProvider>
  );
}
