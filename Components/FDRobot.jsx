import Image from "next/image";

const FDRobot = ({hintText}) => {

    return (
<div className='flex items-center'>
                <Image
                  src = '/images/FDAI_grey.png'
                  alt = 'robot'
                  width={100}
                  height={40}
                  />
                <div className="relative inline-block">
                  <div className="bg-white text-gray-800 rounded-lg p-3 shadow-md z">
                    <span className="relative z-10">
                      {hintText}
                    </span>
                  </div>
                  <div className="absolute top-2 -left-1 w-6 h-6 bg-white transform rotate-[-25deg] z-0"></div>
                </div>
        </div>
    );
  };
  
  export default FDRobot;