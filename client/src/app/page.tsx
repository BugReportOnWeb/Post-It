'use client'

import { Dispatch, useState, SetStateAction } from "react";
import { useAuthContext } from "@/contexts/auth";
import { FormPostCard } from "@/components/community-form/ForumPostCard";
import { PlusIcon, Cross2Icon } from "@radix-ui/react-icons";
import ThreadForm from "@/components/community-form/CreatePostForm";

type FormPostCardProps = {
  title: string,
  description: string
}

const dumy: FormPostCardProps = {
  title: "dummy title",
  description: "fdummmy description kffkkfkfk fk",
}

export default function Home() {
  const [toggleCreatePostForum, setToggleCreatePostForum] = useState<boolean>(false);
  const { authUser } = useAuthContext();

  return (
    <main className="text-2xl p-5 flex justify-center items-center">
      <div className="w-10/12 flex flex-col gap-5 items-center">
        <div className="w-2/3 flex justify-between font-caveat text-center text-4xl px-5 py-8 tracking-wide">
          <h1>Community Forum</h1>
          {authUser && (
            <CreatePost dailogState={toggleCreatePostForum} setDailog={setToggleCreatePostForum} />
          )}
        </div>
        <div className="w-full flex flex-col items-center justify-center">
          <FormPostCard PostData={dumy} />
        </div>
      </div>
      {toggleCreatePostForum && (
        <CreatePostForum setDailog={setToggleCreatePostForum} />
      )}
    </main>
  );
}

const CreatePost = ({ dailogState, setDailog }: { dailogState: boolean, setDailog: Dispatch<SetStateAction<boolean>> }) => {
  return (
    <div className="font-semibold cursor-pointer font-sans tracking-normal text-lg flex justify-center items-center rounded-md px-3 gap-2 bg-background shadow-sm hover:bg-accent hover:text-accent-foreground border border-accent transition-colors duration-200" onClick={() => setDailog(!dailogState)}>
      <PlusIcon className="size-5" />
      <h1 className="text-sm">Create Post</h1>
    </div>
  )
}

const CreatePostForum = ({ setDailog }: { setDailog: Dispatch<SetStateAction<boolean>> }) => {
  return (
    <div className="absolute inset-0 backdrop-blur-md flex justify-center items-center">
      <div className="relative w-7/12 min-h-96 bg-background border border-border rounded-md">
        <Cross2Icon className="absolute top-3 right-3 size-8 hover:text-red-300 cursor-pointer transition-colors duration-150" onClick={() => setDailog(false)} />
        <ThreadForm />
      </div>
    </div>
  )
}
