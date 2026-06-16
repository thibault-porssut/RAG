import Interview from "@/component/interviewScreen";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {

    const { id } = await params;
    return (
       
        <Interview interviewId={id} key={id} />

    );

}